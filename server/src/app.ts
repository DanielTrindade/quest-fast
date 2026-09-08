import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { rotasDeAuth } from './auth/routes.ts';
import { rotasDeCampanhas } from './campanhas/routes.ts';
import type { Contexto, Deps } from './contexto.ts';
import { requireAuth } from './middleware.ts';

export type OpcoesDaApp = Deps & {
  /** Quando falso, o SPA não é servido — usado pelos testes de integração. */
  servirClient?: boolean;
};

export function criarApp({ servirClient = true, ...deps }: OpcoesDaApp) {
  const app = new Hono<Contexto>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/auth', rotasDeAuth());

  app.get('/api/auth/me', requireAuth, (c) => {
    const { id, nome, avatarUrl } = c.var.usuario;
    return c.json({ usuario: { id, nome, avatarUrl } });
  });

  app.route('/api/campanhas', rotasDeCampanhas());

  // Toda rota sob /api que não existe é erro de API, nunca o HTML do SPA.
  app.all('/api/*', (c) => c.json({ erro: 'Rota não encontrada.' }, 404));

  if (servirClient) {
    app.use('/*', serveStatic({ root: deps.env.clientDir }));
    // Fallback do SPA: rotas do TanStack Router não existem em disco.
    app.get('/*', serveStatic({ root: deps.env.clientDir, path: 'index.html' }));
  }

  return app;
}
