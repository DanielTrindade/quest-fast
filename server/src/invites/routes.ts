import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { campaignMembers } from '@quest-fast/db';
import type { InvitePreview } from '@quest-fast/shared';
import type { Context } from '../context.ts';
import { isBanned } from '../campaigns/bans.ts';
import { optionalAuth } from '../middleware.ts';
import { findInvite } from './invite-lookup.ts';

export function inviteRoutes() {
  const routes = new Hono<Context>();

  routes.get('/:code', optionalAuth, (c) => {
    const { db } = c.var.deps;
    const invite = findInvite(db, c.req.param('code'));
    if (!invite) return c.json({ error: 'Convite inválido.' }, 404);

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
