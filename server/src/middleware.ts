import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import { campaignMembers } from '@quest-fast/db';
import type { Papel } from '@quest-fast/shared';
import { getCookie } from 'hono/cookie';
import type { Contexto } from './contexto.ts';
import { COOKIE_SESSAO, usuarioDaSessao } from './auth/session.ts';

/** Nenhuma rota de dados responde sem sessão válida. */
export const requireAuth = createMiddleware<Contexto>(async (c, next) => {
  const { db } = c.var.deps;
  const sessaoId = getCookie(c, COOKIE_SESSAO);
  const usuario = sessaoId ? usuarioDaSessao(db, sessaoId) : undefined;
  if (!usuario) return c.json({ erro: 'Não autenticado.' }, 401);
  c.set('usuario', usuario);
  await next();
});

/**
 * Resolve o papel a partir de `CampaignMember`. Quem não é membro recebe 404,
 * não 403: confirmar que a campanha existe já é vazamento para não-membro.
 */
export function requireCampaignRole(...papeisPermitidos: Papel[]) {
  return createMiddleware<Contexto>(async (c, next) => {
    const { db } = c.var.deps;
    const usuario = c.var.usuario;
    const campanhaId = c.req.param('campanhaId');
    if (!campanhaId) return c.json({ erro: 'Campanha não informada.' }, 400);

    const membro = db
      .select({ papel: campaignMembers.papel })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campanhaId), eq(campaignMembers.userId, usuario.id)))
      .get();

    if (!membro) return c.json({ erro: 'Campanha não encontrada.' }, 404);
    if (papeisPermitidos.length > 0 && !papeisPermitidos.includes(membro.papel)) {
      return c.json({ erro: 'Ação permitida apenas ao mestre.' }, 403);
    }

    c.set('papel', membro.papel);
    c.set('campanhaId', campanhaId);
    await next();
  });
}
