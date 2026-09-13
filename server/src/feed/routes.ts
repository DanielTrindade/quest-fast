import { Hono } from 'hono';
import type { Context } from '../context.ts';
import { requireAuth, requireCampaignRole } from '../middleware.ts';
import { readFeed } from '../events/feed.ts';

/**
 * The campaign's realtime feed, read as state: whoever opens the campaign
 * after an event sees it here, exactly like someone who was connected.
 * Secret events never reach a player's read.
 */
export function feedRoutes() {
  const routes = new Hono<Context>();
  routes.use('*', requireAuth);

  routes.get('/', requireCampaignRole(), (c) => {
    const { db } = c.var.deps;
    const before = c.req.query('before');
    const rawLimit = Number(c.req.query('limit'));
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 50;
    const { events, nextCursor } = readFeed(db, c.var.campaignId, c.var.role, { limit, before });
    return c.json({ events, nextCursor });
  });

  return routes;
}