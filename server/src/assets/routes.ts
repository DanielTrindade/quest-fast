import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { assets } from '@quest-fast/db';
import type { AssetUploadResponse } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { ALLOWED_IMAGE_TYPES, MAX_ASSET_SIZE } from './store.ts';

/**
 * Avatar upload. Files are validated by mime and size before the store is
 * touched; nothing here trusts the file name from the client.
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
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return c.json({ error: 'Formato não permitido. Use PNG, JPEG, WebP ou GIF.' }, 422);
    }
    if (file.size === 0) {
      return c.json({ error: 'O arquivo de imagem está vazio.' }, 422);
    }
    if (file.size > MAX_ASSET_SIZE) {
      return c.json({ error: 'A imagem deve ter até 5 MB.' }, 413);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const stored = await store.save(c.var.campaignId, buffer, file.type);
    const asset = db
      .insert(assets)
      .values({
        id: randomUUID(),
        campaignId: c.var.campaignId,
        uploadedById: c.var.user.id,
        path: stored.path,
        mimeType: file.type,
        size: file.size,
      })
      .returning()
      .get();

    const response: AssetUploadResponse = { asset: { id: asset.id, url: stored.url } };
    return c.json(response, 201);
  });

  return routes;
}