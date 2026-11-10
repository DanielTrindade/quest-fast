import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignBans, users, type Db } from '@quest-fast/db';
import type { Context } from '../context.ts';
import { requireCampaignRole } from '../middleware.ts';

export function isBanned(db: Db, campaignId: string, userId: string): boolean {
  const row = db
    .select({ id: campaignBans.id })
    .from(campaignBans)
    .where(and(eq(campaignBans.campaignId, campaignId), eq(campaignBans.userId, userId)))
    .get();
  return row !== undefined;
}

export function banRoutes() {
  const routes = new Hono<Context>();

  routes.get('/:campaignId/bans', requireCampaignRole('master'), (c) => {
    const { db } = c.var.deps;
    const bans = db
      .select({
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
        bannedAt: campaignBans.createdAt,
      })
      .from(campaignBans)
      .innerJoin(users, eq(users.id, campaignBans.userId))
      .where(eq(campaignBans.campaignId, c.var.campaignId))
      .orderBy(desc(campaignBans.createdAt), desc(campaignBans.id))
      .all();
    return c.json({ bans });
  });

  routes.delete('/:campaignId/bans/:userId', requireCampaignRole('master'), (c) => {
    const { db } = c.var.deps;
    const released = db
      .delete(campaignBans)
      .where(and(eq(campaignBans.campaignId, c.var.campaignId), eq(campaignBans.userId, c.req.param('userId'))))
      .returning({ id: campaignBans.id })
      .all();
    if (released.length === 0) return c.json({ error: 'Bloqueio não encontrado.' }, 404);
    return c.body(null, 204);
  });

  return routes;
}
