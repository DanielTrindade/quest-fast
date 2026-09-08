import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import { campaignMembers } from '@quest-fast/db';
import type { Role } from '@quest-fast/shared';
import { getCookie } from 'hono/cookie';
import type { Context } from './context.ts';
import { SESSION_COOKIE, sessionUser } from './auth/session.ts';

/** No data route answers without a valid session. */
export const requireAuth = createMiddleware<Context>(async (c, next) => {
  const { db } = c.var.deps;
  const sessionId = getCookie(c, SESSION_COOKIE);
  const user = sessionId ? sessionUser(db, sessionId) : undefined;
  // Message is player-facing, so it stays in Portuguese.
  if (!user) return c.json({ error: 'Não autenticado.' }, 401);
  c.set('user', user);
  await next();
});

/**
 * Resolves the role from `CampaignMember`. A non-member gets 404, not 403:
 * confirming the campaign exists is already a leak to a non-member.
 */
export function requireCampaignRole(...allowedRoles: Role[]) {
  return createMiddleware<Context>(async (c, next) => {
    const { db } = c.var.deps;
    const user = c.var.user;
    const campaignId = c.req.param('campaignId');
    if (!campaignId) return c.json({ error: 'Campanha não informada.' }, 400);

    const member = db
      .select({ role: campaignMembers.role })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, user.id)))
      .get();

    if (!member) return c.json({ error: 'Campanha não encontrada.' }, 404);
    if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
      return c.json({ error: 'Ação permitida apenas ao mestre.' }, 403);
    }

    c.set('role', member.role);
    c.set('campaignId', campaignId);
    await next();
  });
}
