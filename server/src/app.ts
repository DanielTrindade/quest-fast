import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { authRoutes } from './auth/routes.ts';
import { campaignRoutes } from './campaigns/routes.ts';
import { assetRoutes } from './assets/routes.ts';
import { characterRoutes } from './characters/routes.ts';
import { diceRoutes } from './dice/routes.ts';
import { feedRoutes } from './feed/routes.ts';
import type { Context, Deps } from './context.ts';
import { requireAuth } from './middleware.ts';

export type AppOptions = Deps & {
  /** When false the SPA is not served — used by the integration tests. */
  serveClient?: boolean;
};

export function createApp({ serveClient = true, ...deps }: AppOptions) {
  const app = new Hono<Context>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/auth', authRoutes());

  app.get('/api/auth/me', requireAuth, (c) => {
    const { id, name, avatarUrl } = c.var.user;
    return c.json({ user: { id, name, avatarUrl } });
  });

  app.route('/api/campaigns', campaignRoutes());
  app.route('/api/campaigns/:campaignId/characters', characterRoutes());
  app.route('/api/campaigns/:campaignId/assets', assetRoutes());
  app.route('/api/campaigns/:campaignId/rolls', diceRoutes());
  app.route('/api/campaigns/:campaignId/feed', feedRoutes());

  // Any missing route under /api is an API error, never the SPA's HTML.
  app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.' }, 404));

  // Uploaded assets (avatars today, maps in a later change) come from disk.
  app.use('/uploads/*', serveStatic({ root: deps.env.uploadsDir }));

  if (serveClient) {
    app.use('/*', serveStatic({ root: deps.env.clientDir }));
    // SPA fallback: TanStack Router routes do not exist on disk.
    app.get('/*', serveStatic({ root: deps.env.clientDir, path: 'index.html' }));
  }

  return app;
}
