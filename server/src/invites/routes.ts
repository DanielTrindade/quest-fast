import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignMembers } from '@quest-fast/db';
import type { InvitePreview } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { isBanned } from '../campaigns/bans.ts';
import { optionalAuth } from '../middleware.ts';
import { originKey, tooManyAttempts, type AttemptLimiter } from './attempt-limiter.ts';
import { createCardProvider } from './card.ts';
import { findInvite } from './invite-lookup.ts';
import { cardVersion } from './meta.ts';

export function inviteRoutes(attempts: AttemptLimiter) {
  const routes = new Hono<Context>();
  const cards = createCardProvider();

  routes.get('/:code/card.png', async (c) => {
    const origin = [originKey(c)];
    const wait = attempts.retryAfter(origin);
    if (wait) return tooManyAttempts(c, wait);
    const invite = findInvite(c.var.deps.db, c.req.param('code'));
    if (!invite) {
      attempts.fail(origin);
      return c.json({ error: 'Convite inválido.' }, 404);
    }

    const png = await cards.get(invite.code, cardVersion(invite), invite);
    return c.body(png as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  });

  routes.get('/:code', optionalAuth, (c) => {
    const { db } = c.var.deps;
    const origin = [originKey(c)];
    const wait = attempts.retryAfter(origin);
    if (wait) return tooManyAttempts(c, wait);
    const invite = findInvite(db, c.req.param('code'));
    if (!invite) {
      attempts.fail(origin);
      return c.json({ error: 'Convite inválido.' }, 404);
    }

    const viewer = c.var.viewer;
    let status: InvitePreview['viewer'] = 'anonymous';
    if (viewer) {
      const member = db
        .select({ id: campaignMembers.id })
        .from(campaignMembers)
        .where(and(eq(campaignMembers.campaignId, invite.campaignId), eq(campaignMembers.userId, viewer.id)))
        .get();
      if (member) status = 'member';
      else status = isBanned(db, invite.campaignId, viewer.id) ? 'blocked' : 'guest';
    }

    const preview: InvitePreview = {
      code: invite.code,
      campaignName: invite.campaignName,
      master: { name: invite.masterName, avatarUrl: invite.masterAvatarUrl },
      playerCount: invite.playerCount,
      viewer: status,
      ...(status === 'member' ? { campaignId: invite.campaignId } : {}),
    };
    return c.json(preview);
  });

  return routes;
}
