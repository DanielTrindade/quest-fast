import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { authRoutes } from './auth/routes.ts';
import { createAttemptLimiter, type AttemptLimiterOptions } from './invites/attempt-limiter.ts';
import { inviteRoutes } from './invites/routes.ts';
import { invitePageHandler } from './invites/meta.ts';
import { campaignRoutes } from './campaigns/routes.ts';
import { assetRoutes } from './assets/routes.ts';
import { characterRoutes } from './characters/routes.ts';
import { diceRoutes } from './dice/routes.ts';
import { feedRoutes } from './feed/routes.ts';
import { statblockRoutes } from './statblocks/routes.ts';
import { encounterRoutes } from './combat/routes.ts';
import type { Context, Deps } from './context.ts';
import { requireAuth } from './middleware.ts';

export type AppOptions = Deps & {
  /** When false the SPA is not served — used by the integration tests. */
  serveClient?: boolean;
  inviteAttempts?: AttemptLimiterOptions;
};

export function createApp({ serveClient = true, inviteAttempts, ...deps }: AppOptions) {
  const app = new Hono<Context>();
  // One budget for every route that takes an invite code, so alternating
  // between them does not multiply the guesses.
  const attempts = createAttemptLimiter(inviteAttempts);

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

  app.route('/api/invites', inviteRoutes(attempts));
  app.route('/api/campaigns', campaignRoutes(attempts));
  app.route('/api/campaigns/:campaignId/characters', characterRoutes());
  app.route('/api/campaigns/:campaignId/assets', assetRoutes());
  app.route('/api/campaigns/:campaignId/rolls', diceRoutes());
  app.route('/api/campaigns/:campaignId/feed', feedRoutes());
  app.route('/api/campaigns/:campaignId/statblocks', statblockRoutes());
  app.route('/api/campaigns/:campaignId/encounters', encounterRoutes());

  // Any missing route under /api is an API error, never the SPA's HTML.
  app.all('/api/*', (c) => c.json({ error: 'Rota não encontrada.' }, 404));

  // Uploaded assets (avatars today, maps in a later change) come from disk.
  // The public URL keeps the /uploads prefix, but the files sit directly under
  // uploadsDir (`<uploadsDir>/campaigns/...`), so the prefix is dropped first.
  app.use('/uploads/*', serveStatic({
    root: deps.env.uploadsDir,
    rewriteRequestPath: (path) => path.replace(/^\/uploads/, ''),
  }));
  // A missing upload is a 404, never the SPA's HTML: an <img> fed index.html
  // fails silently and hides the broken URL.
  app.all('/uploads/*', (c) => c.json({ error: 'Arquivo não encontrado.' }, 404));

  if (serveClient) {
    app.get('/invite/:code', invitePageHandler(attempts));
    app.use('/*', serveStatic({ root: deps.env.clientDir }));
    // SPA fallback: TanStack Router routes do not exist on disk.
    app.get('/*', serveStatic({ root: deps.env.clientDir, path: 'index.html' }));
  }

  return app;
}
